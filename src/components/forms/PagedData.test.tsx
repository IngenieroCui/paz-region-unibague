import {expect,it} from 'vitest'
import {render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {PagedResults} from './PagedData'
const props={error:'',count:1,page:0,setPage:()=>{},reload:async()=>{}}
it('preserves an open detail and sibling unsaved inputs during a background refresh',async()=>{
 const children=<details><summary>Perfil de plaza</summary><label>Descripción pendiente<input/></label></details>
 const view=render(<PagedResults {...props} loading={false}>{children}</PagedResults>)
 const details=screen.getByText('Perfil de plaza').closest('details');if(!details)throw new Error('Missing detail');details.open=true
 const input=screen.getByLabelText('Descripción pendiente');await userEvent.type(input,'Edición pendiente')
 view.rerender(<PagedResults {...props} loading>{children}</PagedResults>)
 expect(screen.getByLabelText('Descripción pendiente')).toBe(input);expect(input).toHaveValue('Edición pendiente');expect(details.open).toBe(true)
 view.rerender(<PagedResults {...props} loading={false}>{children}</PagedResults>);expect(details.open).toBe(true)
})
it('disables pagination while loading existing records',()=>{render(<PagedResults {...props} count={51} loading><p>Registros actuales</p></PagedResults>);expect(screen.getByRole('button',{name:'Siguiente'})).toBeDisabled();expect(screen.getByText('Registros actuales')).toBeInTheDocument()})
