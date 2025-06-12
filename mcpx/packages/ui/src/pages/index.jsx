import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import Analytics from "./Analytics";
import Dashboard from "./Dashboard";
import Layout from "./Layout";

export default function Pages() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/Dashboard" element={<Dashboard />} />
          <Route path="/Analytics" element={<Analytics />} />
        </Routes>
      </Layout>
    </Router>
  );
}
