-- Migration: 016 - Create suburb_html_templates table
-- Purpose: Store customizable HTML content for each suburb's PDF report
-- Note: All tracking logic is in application layer (lib/tracking.ts)

CREATE TABLE IF NOT EXISTS suburb_html_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Suburb identifier
    suburb_name VARCHAR(50) UNIQUE NOT NULL,

    -- Content fields (HTML supported)
    header_title VARCHAR(200),
    local_insights TEXT,
    agent_note TEXT,
    footer_disclaimer TEXT,

    -- Style configuration
    primary_color VARCHAR(10) DEFAULT '#2563EB',

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_templates_suburb ON suburb_html_templates(suburb_name);

COMMENT ON TABLE suburb_html_templates IS 'Customized HTML content templates for each suburb PDF report';
