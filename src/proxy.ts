import { auth } from "@/lib/auth";

export const config = {
  matcher: ["/dashboard/:path*"],
};

export default auth;
