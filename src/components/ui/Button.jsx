export default function Button({children, variant='default', className='', type='button', ...props}){
  const cls = ['btn', variant==='ghost'&&'ghost', variant==='brand'&&'brand', variant==='danger'&&'danger'].filter(Boolean).join(' ')
  return <button type={type} className={`${cls} ${className}`} {...props}>{children}</button>
}
