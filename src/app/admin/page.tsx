import { AdminDashboard } from "@/components/AdminDashboard";

export const metadata = {
  title: "Zev Lock — Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminDashboard />;
}
