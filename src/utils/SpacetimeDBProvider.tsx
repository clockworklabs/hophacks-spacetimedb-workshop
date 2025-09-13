import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from "react";
import { SpacetimeDBContext } from "./useSpacetimeDB";
import { Identity } from "@clockworklabs/spacetimedb-sdk";
import { DbConnection, ErrorContext } from "../module_bindings";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export const SpacetimeDBProvider: FC<{
  onConnect?: (connection: DbConnection, identity: Identity, token: string) => void;
  onDisconnect?: (ctx: ErrorContext, error?: Error | undefined) => void;
  onConnectError?: (ctx: ErrorContext, error: Error) => void;
  token?: string;
  moduleName: string;
  uri: string;
  compression?: "gzip" | "none";
  lightMode?: boolean;
  children?: ReactNode;
  fallback?: ReactNode;
}> = ({
  onConnect,
  onDisconnect,
  onConnectError,
  moduleName,
  uri,
  compression,
  lightMode,
  children,
  fallback,
}) => {
  const [client, setClient] = useState<any>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const aliveRef = useRef(true); // Prevent issues with late events after unmount, especially with StrictMode

  const configuredBuilder = useMemo(() => {
    const builder = DbConnection.builder();
    if (onConnect) {
      builder.onConnect(onConnect);
    }
    if (onDisconnect) {
      builder.onDisconnect(onDisconnect);
    }
    if (onConnectError) {
      builder.onConnectError(onConnectError);
    }
    return builder
      .withModuleName(moduleName)
      .withUri(uri)
      .withCompression(compression ?? "gzip")
      .withLightMode(lightMode ?? false);
  }, [moduleName, onConnect, onDisconnect, onConnectError, uri, compression, lightMode]);

  useEffect(() => {
    aliveRef.current = true;
    setStatus("connecting");

    const b = configuredBuilder
      .onConnect(() => {
        if (!aliveRef.current) return;
        setStatus("connected");
      })
      .onDisconnect(() => {
        if (!aliveRef.current) return;
        setStatus("disconnected");
      })
      .onConnectError(() => {
        if (!aliveRef.current) return;
        setStatus("error");
      });

    const newClient = b.build();
    setClient((prev: any) => {
      prev?.disconnect?.();
      return newClient;
    });

    return () => {
      aliveRef.current = false;
      newClient?.disconnect?.();
    };
  }, [configuredBuilder]);

  if (!client || status !== "connected") {
    return <>{fallback ?? <div>Connecting to SpacetimeDB…</div>}</>;
  }

  return (
    <SpacetimeDBContext.Provider
      value={{ client, status, identity: client.identity, token: client.token }}
    >
      {children}
    </SpacetimeDBContext.Provider>
  );
};