const andares = [
  { id: 101, nome: 'Térreo' },
  { id: 102, nome: '1º Andar' },
];

const racks = [
  {
    id: 201,
    nome: 'Rack Principal',
    patchPanels: [
      { id: 301, nome: 'Patch Panel A', portas: 24 },
      { id: 302, nome: 'Patch Panel B', portas: 24 },
    ],
  },
  {
    id: 202,
    nome: 'Rack Secundário',
    patchPanels: [{ id: 303, nome: 'Patch Panel C', portas: 24 }],
  },
];

const mesas = andares.flatMap((andar, andarIndex) =>
  Array.from({ length: 5 }, (_, mesaIndex) => {
    const mesaNumber = mesaIndex + 1;
    const id = andar.id * 10 + mesaNumber;
    const rack = mesaIndex % 2 === 0 ? racks[0] : racks[1];
    const patchPanel = rack.patchPanels[(mesaIndex + andarIndex) % rack.patchPanels.length];

    return {
      id,
      nome: `Mesa ${mesaNumber.toString().padStart(2, '0')}`,
      x: 80 + (mesaIndex % 3) * 180,
      y: 100 + Math.floor(mesaIndex / 3) * 190,
      largura: 140,
      altura: 100,
      cor: '#2563eb',
      rotacao: 0,
      andarId: andar.id,
      andarNome: andar.nome,
      pontos: Array.from({ length: 8 }, (_, pontoIndex) => {
        const connected = pontoIndex < 3 && (mesaIndex + pontoIndex + andarIndex) % 4 !== 0;
        return {
          id: pontoIndex + 1,
          rackId: connected ? rack.id : null,
          patchId: connected ? patchPanel.id : null,
          porta: connected ? ((mesaIndex * 3 + pontoIndex + andarIndex * 12) % 24) + 1 : null,
          atencao: connected && pontoIndex === 2 && mesaIndex === 1,
        };
      }),
    };
  })
);

const elements = andares.flatMap((andar, andarIndex) => {
  const mesaElements = mesas
    .filter(mesa => mesa.andarId === andar.id)
    .map((mesa, index) => ({
      id: `demo-mesa-${mesa.id}`,
      tipo: 'mesa',
      nome: mesa.nome,
      x: 140 + (index % 3) * 320,
      y: 180 + Math.floor(index / 3) * 300,
      largura: 220,
      altura: 140,
      cor: '#2563eb',
      rotacao: 0,
      ordem: index,
      font_size: 16,
      andarId: andar.id,
      dados_json: { mesaId: mesa.id },
    }));

  return [
    ...mesaElements,
    {
      id: `demo-rack-${andar.id}`,
      tipo: 'rack',
      nome: andarIndex === 0 ? 'Rack Principal' : 'Rack Secundário',
      x: 1120,
      y: 180,
      largura: 170,
      altura: 300,
      cor: '#7c3aed',
      rotacao: 0,
      ordem: 10,
      font_size: 16,
      andarId: andar.id,
    },
    {
      id: `demo-objeto-${andar.id}`,
      tipo: 'objeto',
      nome: 'Área de trabalho',
      x: 1120,
      y: 560,
      largura: 220,
      altura: 100,
      cor: '#374151',
      rotacao: 0,
      ordem: 11,
      font_size: 14,
      andarId: andar.id,
    },
  ];
});

export const DEMO_DATA = {
  empresaNome: 'Empresa Demonstração',
  andares,
  mesas,
  racks,
  elements,
};
