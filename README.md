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
- Combinar o reemplazar por sección, revisar cambios, descargar respaldo y comprobar el resultado.
- Exportar/importar JSON. Si una escritura falla, intentar restaurar las secciones afectadas y comprobarlo.

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

## Restaurar un respaldo

Antes de aplicar, descarga el JSON del resumen y consérvalo. Para restaurarlo, impórtalo en **Mi plantilla**, abre **Copiar cuentas**, conecta el destino y selecciona **Reemplazar**. Las transferencias no son transacciones: un fallo de red puede impedir tanto aplicar como restaurar; la interfaz indica si pudo comprobar la recuperación.

## Verificación y límites

```bash
npm run build
npm test
```

Pruebas de combinación, reemplazo, saneado de IDs, URLs inválidas, autorización, persistencia y contratos HTTP para servidor local y funciones. Las pruebas simulan Nuvio; no modifican cuentas reales. La compatibilidad completa necesita probarse con tus cuentas. Se contrastaron rutas y campos con el cliente público de [Nuvio Account Manager](https://github.com/techuhak/Nuvio-Account-Manager).

Algunos ajustes son locales al dispositivo y no se transfieren. Los perfiles que heredan complementos deben configurarse desde el principal. Las colecciones conservan sus IDs y referencias de catálogo. La apariencia no ha sido verificada en navegador en este entorno.

Herramienta independiente, no afiliada ni respaldada por Nuvio.
