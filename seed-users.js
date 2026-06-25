-- Seed: usuário inicial
-- A senha é definida via ADMIN_PASSWORD em produção.
-- Para gerar o hash, use: node seed-password.js <senha>

INSERT INTO users (username, password_hash) VALUES
  ('microgate.info', '$2b$08$AGdC/LgScpNNc1D8QBMlauPpNJfLLKdGKWKpyIRf3H.9roKL6ZWc2')
ON DUPLICATE KEY UPDATE password_hash = '$2b$08$AGdC/LgScpNNc1D8QBMlauPpNJfLLKdGKWKpyIRf3H.9roKL6ZWc2';
