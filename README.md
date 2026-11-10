# Nuvio Sync

App web en español para guardar una plantilla de Nuvio e instalarla en otras cuentas, o copiar la configuración entre un perfil de origen y uno de destino.

## Desplegar en Netlify desde GitHub

1. En Netlify elige **Add new project → Import an existing project → GitHub** y selecciona este repositorio.
2. Netlify detectará `netlify.toml`: comando **`npm run build`**, directorio publicado **`public`**, funciones **`netlify/functions`**, Node **24**. Deja el directorio base vacío.
3. Añade la variable de entorno **`OWNER_EMAIL`** con el correo de tu cuenta Nuvio. Debe estar disponible en **Functions**; no es tu correo de Netlify salvo que coincidan. No añadas tu contraseña.
4. Despliega. Si añades o cambias la variable después, vuelve a desplegar para que las funciones la reciban.
5. Abre la web, entra en **Mi plantilla**, conecta tu cuenta Nuvio, selecciona el perfil, revisa las URLs y guarda. Tus amigos podrán abrir **Instalar plantilla** y conectar su cuenta de destino.

La API corre en Netlify Functions. La plantilla se guarda en **Netlify Blobs** con consistencia fuerte y persiste entre despliegues de producción. No hace falta configurar una base de datos, un token personal de Netlify ni un servidor aparte. Los Deploy Previews y los branch deploys usan almacenamiento aislado por despliegue y no modifican la plantilla de producción.

Importa el repositorio en Netlify; arrastrar únicamente la carpeta `public` no instala las funciones. El proyecto no incluye una plantilla de muestra que se haga pasar por tu configuración: la primera la guardas desde tu cuenta.

## Funciones

- **Instalar plantilla:** instantánea compartida que solo el propietario autenticado puede actualizar.
- **Copiar cuentas:** conectar origen y destino, elegir perfiles y transferir add-ons, plugins y colecciones.
- Agregar elementos nuevos y actualizar complementos coincidentes, revisar cambios, descargar respaldo y comprobar el resultado.
- Exportar/importar JSON. Si una escritura falla, se detiene la operación sin eliminar elementos para deshacerla.

Las cuentas y contraseñas no se guardan. Las contraseñas pasan por la función durante el inicio de sesión hacia Nuvio. Los tokens temporales quedan en memoria del navegador; si expiran, vuelve a conectar. No se utiliza localStorage para credenciales. El login tiene un límite nativo de 12 solicitudes por IP cada minuto.

La plantilla es legible por quienes accedan al sitio. Revisa las URLs, incluso las referencias dentro de colecciones: pueden contener claves personales. Copiar una configuración no transfiere suscripciones ni autoriza usar las claves de otra persona.

## Ejecutar localmente

Requiere Node.js 22 o superior.

```bash
npm ci
cp .env.example .env
# Edita OWNER_EMAIL en .env con tu correo de Nuvio.
npm start
```

Abre http://localhost:3000. El servidor local usa `data/template.json`; este archivo no se sube a GitHub y no se sincroniza automáticamente con la plantilla de Netlify. Para usar la misma configuración, expórtala como JSON e impórtala en **Mi plantilla** de la web desplegada. Se incluye un Dockerfile para alojamiento alternativo con volumen persistente en `/data`.

## Conservación de los datos del destino

Se agregan add-ons y plugins que falten. Si coinciden con uno del origen, se aplica la configuración del origen conservando la posición en destino. El resto de los complementos no cambia. Las colecciones existentes conservan su contenido. La biblioteca, el historial, los nombres de perfiles y las preferencias no tienen rutas de escritura en esta app. La cuenta de origen solo se lee.

La coincidencia se identifica por servidor y ruta de la URL, ignorando parámetros de consulta. Para Torrentio oficial (`torrentio.strem.fun`) también se reconoce la configuración codificada antes de `/manifest.json`. No se compara solo por nombre ni se agrupan todos los complementos alojados en un mismo dominio. Otros servicios que codifiquen su configuración en rutas distintas pueden necesitar una regla específica. En Torrentio, si hay varias configuraciones del mismo servicio, se conserva una con la configuración del origen. Revisa las coincidencias y las claves del origen antes de aplicar.

Antes de aplicar, puedes descargar un respaldo. Si ocurre un fallo parcial, se informa y puedes volver a revisar para agregar lo pendiente; no se borran elementos para deshacer. Las peticiones que no cambian ningún dato no escriben nada.

La API de Nuvio disponible guarda listas completas. El servidor lee la lista actual y conserva sus elementos al añadir los nuevos; no dispone de una operación atómica de agregado. Evita modificar el perfil simultáneamente desde otra app o dispositivo durante la transferencia. Esta protección se comprueba con pruebas simuladas; falta validarla con cuentas reales.

## Verificación y límites

```bash
npm run build
npm test
```

Pruebas de agregado sin sobrescritura, saneado de IDs, URLs inválidas, autorización, persistencia y contratos HTTP para servidor local y funciones. Las pruebas simulan Nuvio; no modifican cuentas reales. La compatibilidad completa necesita probarse con tus cuentas. Se contrastaron rutas y campos con el cliente público de [Nuvio Account Manager](https://github.com/techuhak/Nuvio-Account-Manager).

Algunos ajustes son locales al dispositivo y no se transfieren. Los perfiles que heredan complementos deben configurarse desde el principal. Las colecciones conservan sus IDs y referencias de catálogo. La apariencia no ha sido verificada en navegador en este entorno.

Herramienta independiente, no afiliada ni respaldada por Nuvio.

## Proveedores con cuenta personal

Al guardar una plantilla, los proveedores reconocidos (Nuve+, Nuve Debrid, AddonLatam, LAT-ADD, Progreso Latino, LatinoBox y LTAN) y las URLs con indicios de tokens se convierten en instrucciones de conexión. En **Revisar y guardar** puedes marcar manualmente otros complementos como **Requiere cuenta o enlace personal** e indicar su página pública. La detección es orientativa: revisa siempre los desconocidos. Las colecciones que contienen referencias reconocidas como personales se omiten de la plantilla compartida para evitar publicar credenciales anidadas.

Antes de aplicar desde una plantilla o copiar cuentas, aparece un paso por proveedor personal: abrir su web en otra pestaña, iniciar sesión allí y pegar el enlace HTTPS de instalación terminado en `/manifest.json`. También se puede conservar el enlace ya instalado u omitir el complemento. No hay una integración OAuth automática. El proveedor puede tener requisitos de acceso, invitación o suscripción propios.

Los enlaces del destinatario no se guardan en la plantilla compartida. Si ya habías guardado una plantilla con enlaces personales, vuelve a guardarla tras revisar las clasificaciones para sustituir la instantánea almacenada por la versión protegida. Las lecturas de plantillas antiguas también aplican el filtro de proveedores reconocidos.

## Guía de configuración dentro de la app

En el menú **Guía de configuración** (`/#guia`) se puede consultar el contenido reorganizado del PDF: enlaces de proveedores, pasos, notas, capturas ampliables y revisión final. Incluye búsqueda y casillas de progreso guardadas únicamente en el navegador, sin credenciales. Abrir o marcar la guía no instala complementos ni modifica cuentas. Las referencias originales conservan las advertencias sobre acceso personal, enlaces no confirmados y discrepancias de idiomas.

La guía también incluye los complementos adicionales del perfil seleccionados por el propietario: OpenSubtitles v3, PenguPlay, CNCVerse Bridge, Vidbolt & Filmx Sources, Internet Archive Movies & Shows, PlavioHD y NexoTV. Solo se publican referencias base y notas de acceso; no las rutas personales de instalación.
