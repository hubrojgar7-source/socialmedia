import Sidebar from "@/components/Sidebar";
import ChatBot from "@/components/ChatBot";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6">{children}</main>
      <ChatBot />
    </div>
  );
}
