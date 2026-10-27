import { Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Account from "./pages/Account";
import StaffShell from "./StaffShell";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/account" element={<Account />} />
      <Route path="/app/*" element={<StaffShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
