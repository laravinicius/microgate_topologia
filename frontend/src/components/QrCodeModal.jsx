import { useEffect, useState } from 'react';
import { getToken } from '../api';

export default function QrCodeModal({ mesaId, onClose }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const token = getToken();
    fetch(`/api/mesas/${mesaId}/qr`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Erro ao gerar QR Code');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setImageSrc(url);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });

    return () => {
      if (imageSrc) URL.revokeObjectURL(imageSrc);
    };
  }, [mesaId]);

  const handleDownload = async () => {
    const token = getToken();
    try {
      const res = await fetch(`/api/mesas/${mesaId}/qr`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `mesa-${mesaId}-qr.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <div className="qrOverlay" onClick={onClose}>
      <div className="qrModal" onClick={(e) => e.stopPropagation()}>
        <div className="qrHeader">
          <h3>QR Code da Mesa</h3>
          <button className="qrClose" onClick={onClose}>&times;</button>
        </div>
        <div className="qrBody">
          {loading ? (
            <div className="qrLoading">Gerando...</div>
          ) : error ? (
            <div className="qrError">{error}</div>
          ) : (
            <img src={imageSrc} alt="QR Code" className="qrImage" />
          )}
          <p className="qrHint">Escaneie para ver os dados da mesa</p>
          {!loading && !error && (
            <button className="qrDownload" onClick={handleDownload}>
              Baixar PNG
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
