import { useEffect, useState } from "react";
import { getGatewayMode, subscribeGatewayMode, type GatewayMode } from "@/lib/ai-gateway";

export function useGatewayMode(): GatewayMode {
  const [m, setM] = useState<GatewayMode>(getGatewayMode());
  useEffect(() => subscribeGatewayMode(setM), []);
  return m;
}
