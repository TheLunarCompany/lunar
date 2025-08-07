import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import AccessControls from "./AccessControls";
import Dashboard from "./Dashboard";
import Layout from "./Layout";
import Tools from "./Tools";

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
