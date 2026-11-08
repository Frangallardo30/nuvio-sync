# Referencias y decisiones

Objetivo: dos flujos en español para usuarios de Nuvio: instalar una plantilla compartida o copiar entre cuentas. La cuenta propietaria mantiene una instantánea en el servidor.

Referencias consultadas antes de implementar:

- LatinoKodi Nuvio Autosetup: https://latinokodi.site/nuvio-autosetup/ — asistente de conexión, selección y revisión. Adaptar el orden del proceso; evitar aplicar cambios antes del resumen.
- Nuvio Account Manager: https://github.com/techuhak/Nuvio-Account-Manager — separación de cuenta de origen, destino, perfiles y secciones transferibles. Referencia técnica, sin copiar código de la interfaz.
- Refero: la búsqueda de estilos no respondió por NO_SUBSCRIPTION. Alternativa: referencia aportada por el usuario y guía craft-details.md de Refero para formularios, accesibilidad y estados.

Dirección fijada: herramienta oscura de configuración, navegación persistente, dos columnas origen/destino, formularios breves. Fondo #0c1011, panel #121718, bordes #293132. Verde #c2ef80 reservado para acciones principales, selección y estado positivo. Sistema sans-serif, títulos de 38–53 px, radios 6 px en controles y 12 px en paneles. Gráfico geométrico propio, sin fotografías necesarias.

| Decisión | Fuente | Aplicación |
| --- | --- | --- |
| Asistente con revisión previa | LatinoKodi | Conectar, seleccionar y revisar antes de escribir |
| Dos cuentas y perfiles separados | Account Manager y usuario | Origen a la izquierda; destino a la derecha |
| Plantilla persistente del propietario | Usuario | Almacenamiento en servidor, actualización autorizada por identidad Nuvio |
| Labels, foco visible y errores inline | Refero craft-details | Formularios accesibles y contraseñas con autocomplete |
| Estado vacío sin datos inventados | Contexto | No se muestran add-ons ficticios como si fueran del usuario |

Límite de validación visual: SITES_MANAGED_LINUX_CONTAINER=1 pero no está instalado cua_repl.js. No se improvisó una ruta de control de navegador. Se verifican los recursos y flujos de datos mediante pruebas HTTP.
