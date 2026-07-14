import { BrowserRouter, Route, Routes } from "react-router-dom";
import WaveBackground from "./components/WaveBackground";
import Curate from "./pages/Curate";
import Gallery from "./pages/Gallery";
import Login from "./pages/Login";

export default function App() {
  return (
    <BrowserRouter>
      <WaveBackground />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Gallery />} />
        <Route path="/playlist/:id" element={<Curate />} />
      </Routes>
    </BrowserRouter>
  );
}
