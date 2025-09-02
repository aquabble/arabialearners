export default function Button({children, variant='default', className='', type='button', disabled=false, ...props}){
  const cls = ['btn',
    variant==='ghost' && 'ghost',
    variant==='brand' && 'brand',
    variant==='danger' && 'danger',
    disabled && 'disabled'
  ].filter(Boolean).join(' ');
  return <button type={type} className={`${cls} ${className}`} disabled={disabled} {...props}>{children}</button>;
}
