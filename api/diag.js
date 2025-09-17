export const config = { runtime: "nodejs" }
export default (req,res) => {
  res.setHeader('Access-Control-Allow-Origin','*')
  res.status(200).json({
    ok:true,
    node: process.version,
    env: Object.keys(process.env).filter(k=>k.startsWith('VITE_')||k.startsWith('OPENAI_'))
  })
}
