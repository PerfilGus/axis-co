import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/servidor/auth";

export const { GET, POST } = toNextJsHandler(auth);
