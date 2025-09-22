export const config = { runtime: "nodejs" }
export default (req,res) => {
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';
  const allow = (env !== 'production') || (req?.query?.key && req.query.key === process.env.DIAG_KEY);
  if (!allow) return res.status(404).end();

  res.setHeader('Access-Control-Allow-Origin','*');
  res.status(200).json({
    ok:true,
    node: process.version,
    envNames: Object.keys(process.env).filter(k=>k.startsWith('VITE_')||k.startsWith('OPENAI_'))
  });
}
