import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import AccessControls from "@/pages/AccessControls";
import Dashboard from "@/pages/Dashboard";
import Tools from "@/pages/Tools";

export default function Pages() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/access-controls" element={<AccessControls />} />
          <Route path="/tools" element={<Tools />} />
        </Routes>
      </Layout>
    </Router>
  );
}
