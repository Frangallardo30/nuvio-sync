import {getStore, getDeployStore} from '@netlify/blobs';
import {handleApi} from '../../netlify-handler.mjs';

export default (req,context) => handleApi(req,{
  ownerEmail:Netlify.env.get('OWNER_EMAIL'),
  // Production survives deployments; all other contexts use isolated stores.
  getStore:()=>context.deploy?.context==='production'
    ?getStore({name:'nuvio-templates',consistency:'strong'})
    :getDeployStore({name:'nuvio-templates-preview',consistency:'strong'}),
});
export const config={path:[
  '/api/template','/api/nuvio/profiles','/api/nuvio/addons',
  '/api/nuvio/plugins','/api/nuvio/collections','/api/nuvio/pushAddons',
  '/api/nuvio/pushPlugins','/api/nuvio/pushCollections',
]};
