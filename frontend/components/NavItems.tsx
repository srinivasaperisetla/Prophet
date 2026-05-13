'use client'

import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

const navItems = [
	{ label: 'Home', href: '/' },
	{ label: 'Content', href: '/content' },
	{ label: 'Pricing', href: '/pricing' },
	{ label: 'Test', href: '/test' }
]

const NavItems = () => {
	const pathname = usePathname();

	return (
		<nav className='flex items-center gap-10'>
			{navItems.map(({ label, href }) => (
				<Link href={href} key={label} className={cn(pathname === href && 'text-primary font-semibold')}>
					{label}
				</Link>
			))}
		</nav>
	)
}

export default NavItems