import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';

export default function QRCodeModal({ mesa, empresaSlug, andarId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    generateQRCode();
  }, [mesa, empresaSlug, andarId]);

  const generateQRCode = async () => {
    setLoading(true);
    setError(null);
    setImageUrl(null);
    try {
      const url = `https://topologia.microgateinformatica.com.br/${encodeURIComponent(empresaSlug)}?mesa=${mesa.id}&andar=${andarId || ''}`;
      const qrCanvas = document.createElement('canvas');
      await QRCode.toCanvas(qrCanvas, url, {
        width: 380,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = 380;
      finalCanvas.height = 380;
      const ctx = finalCanvas.getContext('2d');
      ctx.drawImage(qrCanvas, 0, 0, 380, 380);
      const logoSize = 76;
      const logoX = (380 - logoSize) / 2;
      const logoY = (380 - logoSize) / 2;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(logoX - 4, logoY - 4, logoSize + 8, logoSize + 8);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('REDE', 380 / 2, 380 / 2);
      const dataUrl = finalCanvas.toDataURL('image/png');
      setImageUrl(dataUrl);
      setLoading(false);
    } catch (err) {
      setError('Erro ao gerar QR Code');
      setLoading(false);
    }
  };

  const handleDownload = useCallback(() => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.download = `qrcode_mesa_${mesa.nome.replace(/\s+/g, '_')}.png`;
    link.href = imageUrl;
    link.click();
  }, [mesa.nome, imageUrl]);

  return (
    <div className="qrcode-overlay" onClick={onClose}>
      <div className="qrcode-panel" onClick={e => e.stopPropagation()}>
        <div className="qrcode-header">
          <h3>QR Code — {mesa.nome}</h3>
          <button className="qrcode-close" onClick={onClose}>✕</button>
        </div>
        <div className="qrcode-body">
          {loading ? (
            <div className="qrcode-loading">Gerando QR Code...</div>
          ) : error ? (
            <div className="qrcode-error">{error}</div>
          ) : (
            <img src={imageUrl} alt="QR Code" className="qrcode-image" />
          )}
        </div>
        <div className="qrcode-footer">
          <button className="qrcode-download" onClick={handleDownload}>
            Download PNG
          </button>
          <button className="qrcode-cancel" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
