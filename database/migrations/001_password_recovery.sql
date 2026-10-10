-- Aplicar una vez sobre una base existente antes de desplegar la recuperación.
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS correo_electronico VARCHAR(254),
    ADD COLUMN IF NOT EXISTS correo_verificado BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_correo_electronico_unique_idx
    ON usuarios (correo_electronico)
    WHERE correo_electronico IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_tokens (
    token_hash CHAR(64) PRIMARY KEY,
    id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    email VARCHAR(254) NOT NULL,
    purpose VARCHAR(32) NOT NULL CHECK (purpose IN ('email_verification', 'password_reset')),
    expires_at TIMESTAMPTZ NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS auth_tokens_user_purpose_idx
    ON auth_tokens (id_usuario, purpose);
CREATE INDEX IF NOT EXISTS auth_tokens_expiration_idx
    ON auth_tokens (expires_at);
