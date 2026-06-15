<!-- SEED: re-run $impeccable document once there's code to capture the actual tokens and components. -->

# Design System: La Oficina Nítida

## 1. Overview

**Creative North Star: "La Oficina Nítida"**

Este sistema de diseño está diseñado para proporcionar una experiencia de administración limpia, libre de ruidos visuales y enfocada en la eficiencia de las tareas. Se inspira en la estética de Linear y Stripe: tipografía geométrica de alta legibilidad, bordes ultra finos, espaciado generoso pero estructurado, y elevación por capas casi imperceptibles.

Rechaza explícitamente el desorden visual, los colores chillones de alerta constante y la densidad intimidante de los ERPs y sistemas contables tradicionales (como Siigo o World Office). Su objetivo es hacer que la gestión documental masiva se sienta fluida, segura y profesional.

**Key Characteristics:**

- Foco absoluto en la claridad de los datos operativos.
- Estrategia de color altamente restringida (neutros refinados con un único color de acento).
- Movimiento imperceptible y sutil adaptado a la fatiga del uso laboral diario.

## 2. Colors

Estrategia de color restringida basada en neutros limpios con un matiz frío sutil y un único color de acento corporativo.

**The 10% Rule.** El color de acento principal solo se utiliza en elementos de interacción primarios o estados de selección activos. Nunca se usa como fondo decorativo o divisor.

- **Accent (Acento Principal)**: `[to be resolved during implementation: primary corporate color, e.g., deep charcoal or navy oklch]`
- **Neutral Background (Fondo base)**: `[to be resolved during implementation: clean light background with 1% hue shift]`
- **Neutral Ink (Texto principal)**: `[to be resolved during implementation: high contrast dark gray/off-black]`
- **Neutral Border (Bordes)**: `[to be resolved during implementation: low-opacity gray divider]`

## 3. Typography

**Display Font:** Sans-serif (a definir, e.g., Geist Sans / Inter / Outfit)
**Body Font:** Sans-serif (mismo que Display para consistencia estricta)

El sistema utiliza una única familia tipográfica de tipo Sans-Serif moderna y limpia. La jerarquía se construye estrictamente a través de variaciones de peso (weight), tamaño (size) y tracking (letter-spacing), evitando la combinación de múltiples fuentes.

### Hierarchy

- **Display**: `[to be resolved during implementation]` - Usado para títulos hero o paneles de control iniciales.
- **Headline**: `[to be resolved during implementation]` - Usado para títulos de sección o páginas principales.
- **Title**: `[to be resolved during implementation]` - Usado en cabeceras de tablas y tarjetas.
- **Body**: `[to be resolved during implementation]` - Usado para texto principal y datos de lectura (ancho máximo 65-75ch).
- **Label**: `[to be resolved during implementation]` - Usado para metadatos, tags y pequeñas etiquetas.

## 4. Elevation

El sistema es plano por defecto (flat). Se eliminan las sombras pesadas y se prefiere el uso de bordes de baja opacidad y diferencias mínimas de tonalidad de superficie para representar la profundidad. Las sombras solo se aplican en elementos interactivos emergentes o flotantes.

**The Flat-By-Default Rule.** Las superficies están en un plano uniforme. Las sombras solo surgen para indicar interacción directa (ej. hover sobre botones o tarjetas elevadas).

## 5. Components

<!-- Component definitions to be generated automatically once UI implementation begins. -->

## 6. Do's and Don'ts

### Do:

- **Do** limitar el uso del color de acento a menos del 10% del total visual de cualquier pantalla.
- **Do** usar bordes finos de baja opacidad (`rgba`) para separar elementos estructurales.
- **Do** mantener la simetría y usar un sistema de espaciado basado en incrementos de 4px/8px.
- **Do** diseñar estados de hover, focus y active sumamente sutiles y rápidos.

### Don't:

- **Don't** utilizar barras de colores gruesas o líneas de acento de colores en el lateral de las tarjetas.
- **Don't** saturar el dashboard de alertas rojas o amarillas chillonas; usar tonalidades desaturadas o iconos discretos.
- **Don't** mezclar diferentes familias tipográficas Sans-Serif en la misma interfaz.
- **Don't** usar sombras grandes y oscuras que ensucien la interfaz y le quiten el aspecto nítido y moderno.
