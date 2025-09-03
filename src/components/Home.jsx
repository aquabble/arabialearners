// src/components/Home.jsx
import { Card, CardBody, CardTitle, CardSub } from './ui/Card.jsx'
import Button from './ui/Button.jsx'
import WordBankPanel from './WordBankPanel.jsx'

export default function Home({ onNav, user }){
  return (
    <Card>
      <CardBody>
        <CardTitle>Welcome{user?.name ? `, ${user.name}` : ''}</CardTitle>
        <CardSub>Pick a mode to start practicing.</CardSub>

        <div className="mt-16" style={{display:'flex', gap:12, flexWrap:'wrap'}}>
          <Button variant="brand" onClick={()=>onNav?.('translate')}>Translate</Button>
          <Button className="ghost" onClick={()=>onNav?.('word-order')}>Word Order</Button>
          <Button className="ghost" onClick={()=>onNav?.('words')}>Words</Button>
        </div>

        <div className="mt-24">
          <WordBankPanel max={18} onOpenFull={()=>onNav?.('words')} />
        </div>
      </CardBody>
    </Card>
  )
}
