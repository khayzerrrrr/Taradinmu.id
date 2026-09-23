import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import "./types";

// `unstable_update` masih berlabel unstable di NextAuth v5, tetapi inilah API
// resmi untuk menulis ulang sesi JWT dari Server Action — dibutuhkan oleh mode
// "masuk sebagai tenant" (PRD 4.B). Dialias menjadi `update` agar jelas saat dipakai.
export const { handlers, auth, signIn, signOut, unstable_update: update } =
  NextAuth(authConfig);
