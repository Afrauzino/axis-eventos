// O Supabase devolve no máximo 1000 linhas por consulta. Para tabelas que podem
// passar disso (votos, doses, respostas da logística, vínculos de equipe…), busca
// em páginas até acabar. `montar` deve devolver a consulta SEMPRE nova e ORDENADA
// (ex.: () => supabase.from('x').select('*').eq(...).order('id')).
export async function buscarTodos<T = any>(montar: () => any, passo = 1000): Promise<{ data: T[]; error: any }> {
  const todos: T[] = []
  for (let de = 0; ; de += passo) {
    const { data, error } = await montar().range(de, de + passo - 1)
    if (error) return { data: todos, error }
    todos.push(...((data ?? []) as T[]))
    if (!data || data.length < passo) break
  }
  return { data: todos, error: null }
}
