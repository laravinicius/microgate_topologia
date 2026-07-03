import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { api } from '../api';

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

export default function QRCodeBatchPrint({ empresaSlug, onClose }) {
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [qrImages, setQrImages] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/api/qrcode/all-mesas');
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
        console.error('Erro ao gerar QR para mesa', mesa.id, e);
      }
      setProgress(i + 1);
    }
    setLoading(false);
  };

  const handlePrint = useCallback(() => {
    const allPages = [];
    for (let i = 0; i < mesas.length; i += PER_PAGE) {
      allPages.push(mesas.slice(i, i + PER_PAGE));
    }

    const pagesHtml = allPages.map((page, pageIndex) => {
      const cells = page.map(mesa => {
        const img = qrImages[mesa.id];
        const label = mesa.andarNome ? `${mesa.andarNome} — ${mesa.nome}` : mesa.nome;
        return `<div class="cell"><img src="${img}" class="qr"/><div class="label">${label}</div></div>`;
      }).join('');
      const breakStyle = pageIndex < allPages.length - 1 ? 'break-after: page;' : '';
      return `<div class="page" style="${breakStyle}">${cells}</div>`;
    }).join('');

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>QR Codes</title>
<style>
@page { size: A4; margin: 0; }
body { margin: 0; padding: 0; }
.page { width: 210mm; height: 297mm; padding: 10mm; box-sizing: border-box; display: grid; grid-template-columns: repeat(5, 1fr); gap: 5mm; align-content: start; }
.cell { display: flex; flex-direction: column; align-items: center; justify-content: center; }
.qr { width: 3cm; height: 3cm; image-rendering: pixelated; }
.label { font-size: 8pt; text-align: center; margin-top: 2px; font-family: sans-serif; }
</style>
</head><body>${pagesHtml}
<script>window.onload=function(){setTimeout(function(){window.print();window.close();},500);}<\/script></body></html>`);

    printWindow.document.close();
  }, [mesas, qrImages]);

  const pages = [];
  for (let i = 0; i < mesas.length; i += PER_PAGE) {
    pages.push(mesas.slice(i, i + PER_PAGE));
  }

  if (mesas.length === 0 && !loading && !error) {
    return (
      <div className="qrcode-overlay" onClick={onClose}>
        <div className="qrcode-panel qrcode-panel-wide" onClick={e => e.stopPropagation()}>
          <div className="qrcode-header">
            <h3>QR Codes em Massa</h3>
            <button className="qrcode-close" onClick={onClose}>✕</button>
          </div>
          <div className="qrcode-body">
            <div className="qrcode-empty">Nenhuma mesa cadastrada</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="qrcode-overlay" onClick={onClose}>
      <div className="qrcode-panel qrcode-panel-wide" onClick={e => e.stopPropagation()}>
        <div className="qrcode-header">
          <h3>QR Codes em Massa — {mesas.length} mesas</h3>
          <div className="qrcode-header-actions">
            {!loading && mesas.length > 0 && (
              <button className="qrcode-print-btn" onClick={handlePrint}>
                Imprimir
              </button>
            )}
            <button className="qrcode-close" onClick={onClose}>✕</button>
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
      </div>
    </div>
  );
}
