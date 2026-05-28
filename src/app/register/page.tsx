import RegisterClient from './RegisterClient'

export default function RegisterPage({ searchParams }: { searchParams?: { plan?: string, ref?: string } }) {
  return (
    <RegisterClient
      initialPlan={searchParams?.plan || 'free'}
      referralCode={searchParams?.ref}
    />
  )
}
