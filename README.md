# Pipeline de clientes

**No ar:** https://gustavoamorim27-svg.github.io/rico-pipeline/ (acesso com senha, a mesma do Hub do Assessor)

- `index.html` é só a tela de login. O app inteiro (HTML, CSS e JavaScript num arquivo só) fica em `app.enc`, compactado e criptografado com AES-256-GCM; a chave sai da senha via PBKDF2-SHA256.
- O código-fonte original fica em `src.enc` (um .tar criptografado com a mesma senha).
- O login é compartilhado com o Hub do Assessor e o MEREO do time: entrar num abre os outros no mesmo aparelho. "Lembrar neste aparelho" vale até a meia-noite da próxima segunda-feira (Brasília).
- O `sw.js` guarda para uso offline só a tela de login e o `app.enc` (criptografado). Os dados dos clientes continuam no navegador e na nuvem cifrada da própria base, como antes.

## Atualizar

```
HUB_SENHA='…' python3 cofre.py abrir src.enc src.tar      # fonte
# editar, montar o app num HTML único
HUB_SENHA='…' python3 cofre.py fechar app.html app.enc    # mantém o sal
```

Nunca suba a senha nem arquivos descriptografados. Ao publicar, suba também `version.json` com versão nova para os aparelhos abertos recarregarem.
