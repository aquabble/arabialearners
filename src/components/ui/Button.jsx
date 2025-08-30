export default function Button({children, variant='default', className='', ...props}){
  const cls = ['btn', variant==='ghost'&&'ghost', variant==='brand'&&'brand', variant==='danger'&&'danger']
    .filter(Boolean).join(' ');
  return <button className={`${cls} ${className}`} {...props}>{children}</button>
}