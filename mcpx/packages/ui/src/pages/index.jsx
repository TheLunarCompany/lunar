import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import AccessControls from "./AccessControls";
import Dashboard from "./Dashboard";
import Layout from "./Layout";

export default function Pages() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/access-controls" element={<AccessControls />} />
        </Routes>
      </Layout>
    </Router>
  );
}
