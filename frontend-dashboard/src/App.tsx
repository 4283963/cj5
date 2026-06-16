import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DexVisualPage } from './pages/DexVisualPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dex/visual" element={<DexVisualPage />} />
        <Route path="/" element={<Navigate to="/dex/visual" replace />} />
        <Route path="*" element={<Navigate to="/dex/visual" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
