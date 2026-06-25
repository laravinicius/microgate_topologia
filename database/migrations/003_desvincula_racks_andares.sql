-- Migration 003: Desvincula racks de andares/setores
-- Torna racks independentes de andares na interface
-- Adiciona andar_nome nas mesas para identificacao nos patch panels
-- Executar no banco: mysql inframap < database/migrations/003_desvincula_racks_andares.sql

-- 1. Criar andar "Sem andar" para cada empresa que possua mesas sem andar associado
INSERT INTO `andares` (`empresa_id`, `nome`)
SELECT DISTINCT m.`empresa_id`, 'Sem andar'
FROM `mesas` m
WHERE m.`andar_id` IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM `andares` a
    WHERE a.`empresa_id` = m.`empresa_id` AND a.`nome` = 'Sem andar'
  );

-- 2. Migrar mesas existentes com andar_id NULL para o andar "Sem andar"
UPDATE `mesas` m
JOIN `andares` a ON a.`empresa_id` = m.`empresa_id` AND a.`nome` = 'Sem andar'
SET m.`andar_id` = a.`id`
  WHERE m.`andar_id` IS NULL;
