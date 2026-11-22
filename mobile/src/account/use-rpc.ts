import { useCallback } from "react";
import { rpc, SignedOutError } from "./api";
import { useAccount } from "./account-context";

/** Calls the website's actions as the signed-in person; signs out if the website refuses. */
export function useRpc() {
  const { token, signOut } = useAccount();
  return useCallback(
    async <T,>(fn: string, ...args: unknown[]): Promise<T> => {
      if (!token) throw new SignedOutError("Войдите в аккаунт");
      try {
        return await rpc<T>(token, fn, ...args);
      } catch (error) {
        if (error instanceof SignedOutError) await signOut();
        throw error;
      }
    },
    [token, signOut],
  );
}
