-- Decreto 1833 de 2016, arts. 2.2.3.1.9 y 2.2.14.1.6:
-- 16 hasta 17, más de 17 hasta 18, más de 18 hasta 19, más de 19 hasta 20,
-- y superiores a 20 SMMLV. Los extremos 17/18/19/20 pertenecen al tramo
-- anterior. No se modifican PayrollSnapshot ni liquidaciones aprobadas.
WITH transformed AS (
  SELECT
    parametro."id",
    jsonb_agg(
      CASE
        WHEN jsonb_typeof(tramo.value) = 'object'
          AND tramo.value->>'desdeSmmlv' IN ('16', '17', '18', '19')
          AND tramo.value->>'hastaSmmlv' IN ('17', '18', '19', '20')
        THEN jsonb_set(
          jsonb_set(
            tramo.value,
            '{desdeIncluido}',
            CASE
              WHEN tramo.value->>'desdeSmmlv' = '16' THEN 'true'::jsonb
              ELSE 'false'::jsonb
            END,
            true
          ),
          '{hastaIncluido}',
          'true'::jsonb,
          true
        )
        WHEN jsonb_typeof(tramo.value) = 'object'
          AND tramo.value->>'desdeSmmlv' IN ('17', '18', '19', '20')
        THEN jsonb_set(
          tramo.value,
          '{desdeIncluido}',
          'false'::jsonb,
          true
        )
        ELSE tramo.value
      END
      ORDER BY tramo.ordinality
    ) AS "fspTramos"
  FROM "parametros_legales_nomina" AS parametro
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(parametro."fspTramos") = 'array'
        THEN parametro."fspTramos"
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS tramo(value, ordinality)
  WHERE parametro."vigenciaDesde" < DATE '2027-04-01'
  GROUP BY parametro."id"
  HAVING bool_or(
    jsonb_typeof(tramo.value) = 'object'
    AND (
      (
        tramo.value->>'desdeSmmlv' IN ('16', '17', '18', '19')
        AND tramo.value->>'hastaSmmlv' IN ('17', '18', '19', '20')
      )
      OR tramo.value->>'desdeSmmlv' = '20'
    )
  )
)
UPDATE "parametros_legales_nomina" AS parametro
SET "fspTramos" = transformed."fspTramos",
    "updatedAt" = CURRENT_TIMESTAMP
FROM transformed
WHERE parametro."id" = transformed."id";
