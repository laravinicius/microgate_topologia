-- Adiciona coluna font_size para controle do tamanho da fonte nos objetos do mapa
-- map_elements: tamanho em pixels (padrão 12px)
-- mesas: tamanho em pixels (padrão 15px)

ALTER TABLE `map_elements` ADD COLUMN `font_size` INT UNSIGNED NOT NULL DEFAULT 12;

ALTER TABLE `mesas` ADD COLUMN `font_size` INT UNSIGNED NOT NULL DEFAULT 15;
