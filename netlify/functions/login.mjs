import {handleApi} from '../../netlify-handler.mjs';
export default req => handleApi(req,{
  ownerEmail:undefined,
  getStore:()=>{throw new Error('Storage is unavailable on the login route.');},
});
export const config={
  path:'/api/nuvio/login',
  method:'POST',
  rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:12},
};
