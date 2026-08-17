-- Migration 007: Acesso de usuarios a empresas (perfil visualizador)
-- Executar no banco: mysql inframap < database/migrations/007_user_empresas.sql

-- Usuarios administradores (is_admin=1) nao precisam de registros aqui: veem todas as empresas.
-- Usuarios visualizadores (is_admin=0) so acessam as empresas listadas nesta tabela.
CREATE TABLE IF NOT EXISTS `user_empresas` (
    `user_id` INT UNSIGNED NOT NULL,
    `empresa_id` INT UNSIGNED NOT NULL,
    PRIMARY KEY (`user_id`, `empresa_id`),
    CONSTRAINT `fk_ue_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ue_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;