import Image from 'next/image'
import Link from 'next/link'
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'
import NavItems from './NavItems'
import { Button } from './ui/button'

const Navbar = () => {
	return (
		<nav className='navbar'>
			<Link href='/'>
				<div className='flex items-center gap-2.5 cursor-pointer'>
					<Image src='/images/logo.svg' alt='logo' width={46} height={44} />
				</div>
			</Link>

			<div>
				<NavItems />
			</div>

			<div className='flex items-center gap-4'>
				<Show when='signed-out'>
					<SignInButton mode='modal'>
						<Button variant='ghost' className='cursor-pointer'>Sign In</Button>
					</SignInButton>
					<SignUpButton mode='modal'>
						<Button className='cursor-pointer'>Sign Up</Button>
					</SignUpButton>
				</Show>
				<Show when='signed-in'>
					<UserButton />
				</Show>
			</div>
		</nav>
	)
}

export default Navbar
