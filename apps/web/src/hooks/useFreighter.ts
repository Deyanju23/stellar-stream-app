'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getAddress,
  getNetworkDetails,
  isConnected as checkIsConnected,
  requestAccess,
  signTransaction as freighterSignTx,
} from '@stellar/freighter-api';
import { CONFIG } from '@/lib/config';

export interface FreighterState {
  isInstalled: boolean;
  isConnected: boolean;
  address: string | null;
  network: string | null;
  networkPassphrase: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useFreighter() {
  const [state, setState] = useState<FreighterState>({
    isInstalled: false,
    isConnected: false,
    address: null,
    network: null,
    networkPassphrase: null,
    isLoading: true,
    error: null,
  });

  // Check initial connection status
  const checkStatus = useCallback(async () => {
    try {
      const installed = await checkIsConnected();
      if (!installed) {
        setState((prev) => ({
          ...prev,
          isInstalled: false,
          isConnected: false,
          isLoading: false,
        }));
        return;
      }

      // Check if user previously approved access
      const stored = localStorage.getItem('freighter_connected');
      if (stored === 'true') {
        const addrRes = await getAddress();
        if (addrRes && addrRes.address) {
          let netDetails = null;
          try {
            netDetails = await getNetworkDetails();
          } catch {
            // ignore network details fetch error
          }

          setState({
            isInstalled: true,
            isConnected: true,
            address: addrRes.address,
            network: netDetails?.network || 'TESTNET',
            networkPassphrase: netDetails?.networkPassphrase || CONFIG.networkPassphrase,
            isLoading: false,
            error: null,
          });
          return;
        }
      }

      setState((prev) => ({
        ...prev,
        isInstalled: true,
        isConnected: false,
        isLoading: false,
      }));
    } catch (err) {
      console.error('[Freighter] Error checking status:', err);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Connect to Freighter
  const connect = useCallback(async (): Promise<string | null> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const installed = await checkIsConnected();
      if (!installed) {
        throw new Error(
          'Freighter wallet extension is not installed. Please install Freighter from https://www.freighter.app',
        );
      }

      const accessObj = await requestAccess();
      if (accessObj && accessObj.error) {
        throw new Error(accessObj.error);
      }

      const addrObj = await getAddress();
      if (!addrObj || !addrObj.address) {
        throw new Error('Failed to retrieve account address from Freighter');
      }

      let netDetails = null;
      try {
        netDetails = await getNetworkDetails();
      } catch {
        // network details optional
      }

      localStorage.setItem('freighter_connected', 'true');

      setState({
        isInstalled: true,
        isConnected: true,
        address: addrObj.address,
        network: netDetails?.network || 'TESTNET',
        networkPassphrase: netDetails?.networkPassphrase || CONFIG.networkPassphrase,
        isLoading: false,
        error: null,
      });

      return addrObj.address;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect Freighter';
      setState((prev) => ({ ...prev, isLoading: false, error: msg }));
      throw err;
    }
  }, []);

  // Disconnect from Freighter
  const disconnect = useCallback(() => {
    localStorage.removeItem('freighter_connected');
    setState((prev) => ({
      ...prev,
      isConnected: false,
      address: null,
      error: null,
    }));
  }, []);

  // Sign a transaction envelope XDR
  const signTx = useCallback(
    async (xdrString: string): Promise<string> => {
      const signed = await freighterSignTx(xdrString, {
        networkPassphrase: CONFIG.networkPassphrase,
      });

      if (typeof signed === 'string') {
        return signed;
      }
      if (signed && typeof signed === 'object') {
        const obj = signed as { signedTxXdr?: string; error?: string };
        if (obj.error) {
          throw new Error(obj.error);
        }
        if (obj.signedTxXdr) {
          return obj.signedTxXdr;
        }
      }
      throw new Error('Transaction signing failed or was canceled in Freighter');
    },
    [],
  );

  return {
    ...state,
    connect,
    disconnect,
    signTx,
    refreshStatus: checkStatus,
  };
}

export function formatAddress(addr: string | null | undefined): string {
  if (!addr) return '';
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}
