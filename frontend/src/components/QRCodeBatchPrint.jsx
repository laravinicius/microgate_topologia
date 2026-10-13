import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { api, requireSuccess } from '../api';

import SystemModal from './SystemModal';

const QR_SIZE = 113;
const COLS = 5;
const ROWS = 7;
const PER_PAGE = COLS * ROWS;

async function generateOneQR(url) {
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, url, {
    width: QR_SIZE,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' }
  });
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = QR_SIZE;
  finalCanvas.height = QR_SIZE;
  const ctx = finalCanvas.getContext('2d');
  ctx.drawImage(qrCanvas, 0, 0, QR_SIZE, QR_SIZE);
  const logoSize = 22;
  const logoX = (QR_SIZE - logoSize) / 2;
  const logoY = (QR_SIZE - logoSize) / 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(logoX - 2, logoY - 2, logoSize + 4, logoSize + 4);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('REDE', QR_SIZE / 2, QR_SIZE / 2);
  return finalCanvas.toDataURL('image/png');
}

export default function QRCodeBatchPrint({ empresaSlug, onClose, embedded = false }) {
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [qrImages, setQrImages] = useState({});
  const [error, setError] = useState(null);
  const Container = embedded ? 'section' : SystemModal;
  const containerProps = embedded
    ? { className: 'qrcode-panel qrcode-panel-wide qrcode-inline', 'aria-label': 'QR Codes em massa' }
    : { title: 'QR Codes em massa', onClose, dismissOnBackdrop: true, overlayClass: 'qrcode-overlay', panelClass: 'qrcode-panel qrcode-panel-wide', print: true };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = requireSuccess(await api.get('/api/qrcode/all-mesas'));
      if (data.success) {
        const filtered = data.mesas.filter(m => m.andarNome || m.andarNome === '');
        setMesas(filtered);
        setTotal(filtered.length);
        setQrImages({});
        setProgress(0);
        await generateAll(filtered);
      }
    } catch (err) {
      setError('Erro ao carregar mesas');
      setLoading(false);
    }
  };

  const generateAll = async (mesasList) => {
    for (let i = 0; i < mesasList.length; i++) {
      const mesa = mesasList[i];
      const url = `https://topologia.microgateinformatica.com.br/${encodeURIComponent(empresaSlug)}?mesa=${mesa.id}&andar=${mesa.andarId || ''}`;
      try {
        const dataUrl = await generateOneQR(url);
        setQrImages(prev => ({ ...prev, [mesa.id]: dataUrl }));
      } catch (e) {
        setError('Não foi possível gerar todas as etiquetas. Feche e tente novamente.');
      }
      setProgress(i + 1);
    }
    setLoading(false);
  };

  const handlePrint = useCallback(() => {
    if (loading || mesas.some(mesa => !qrImages[mesa.id])) return;
    window.print();
  }, [loading, mesas, qrImages]);

  const pages = [];
  for (let i = 0; i < mesas.length; i += PER_PAGE) {
    pages.push(mesas.slice(i, i + PER_PAGE));
  }

  if (mesas.length === 0 && !loading && !error) {
    return (
      <Container {...containerProps}>
          <div className="qrcode-header">
            <h3>QR Codes em Massa</h3>
            <button className="qrcode-close" aria-label="Fechar QR Codes" onClick={onClose}>✕</button>
          </div>
          <div className="qrcode-body">
            <div className="qrcode-empty">Nenhuma mesa cadastrada</div>
          </div>
      </Container>
    );
  }

  return (
    <Container {...containerProps}>
        <div className="qrcode-header">
          <h3>QR Codes em Massa — {mesas.length} mesas</h3>
          <div className="qrcode-header-actions">
            {!loading && mesas.length > 0 && (
              <button className="qrcode-print-btn" onClick={handlePrint} disabled={mesas.some(mesa => !qrImages[mesa.id])}>
                Imprimir
              </button>
            )}
            <button className="qrcode-close" aria-label="Fechar QR Codes" onClick={onClose}>✕</button>
          </div>
        </div>

        {loading && (
          <div className="qrcode-progress-bar">
            <div className="qrcode-progress-fill" style={{ width: `${total ? (progress / total) * 100 : 0}%` }} />
            <span className="qrcode-progress-text">{progress}/{total} QR codes gerados</span>
          </div>
        )}

        <div className="qrcode-batch-container">
          {error && <div className="qrcode-error">{error}</div>}

          {!loading && pages.map((page, pageIndex) => (
            <div key={pageIndex} className="qrcode-page">
              {page.map(mesa => {
                const img = qrImages[mesa.id];
                const label = mesa.andarNome ? `${mesa.andarNome} — ${mesa.nome}` : mesa.nome;
                return (
                  <div key={mesa.id} className="qrcode-cell">
                    {img ? (
                      <img src={img} alt={label} className="qrcode-batch-qr" />
                    ) : (
                      <div className="qrcode-batch-placeholder" />
                    )}
                    <div className="qrcode-batch-label">{label}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
    </Container>
  );
}
