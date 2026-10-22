import { beforeEach, expect, it, vi } from 'vitest'
import { catalog, clearCatalogCache } from './catalog-cache'
beforeEach(clearCatalogCache)
it('deduplicates catalogs for one owner and never shares an owner cache', async () => {
 const load=vi.fn(async()=>['municipality'])
 await Promise.all([catalog('one','municipalities',load),catalog('one','municipalities',load)])
 expect(load).toHaveBeenCalledTimes(1)
 await catalog('two','municipalities',load);expect(load).toHaveBeenCalledTimes(2)
 clearCatalogCache();await catalog('two','municipalities',load);expect(load).toHaveBeenCalledTimes(3)
})
it('expires catalogs and does not cache failures', async () => {
 const time=vi.spyOn(Date,'now').mockReturnValue(0)
 const load=vi.fn().mockRejectedValueOnce(Error('retry')).mockResolvedValue(['ok'])
 await expect(catalog('one','skills',load)).rejects.toThrow('retry')
 await catalog('one','skills',load);expect(load).toHaveBeenCalledTimes(2)
 time.mockReturnValue(300001);await catalog('one','skills',load);expect(load).toHaveBeenCalledTimes(3)
 time.mockRestore()
})
