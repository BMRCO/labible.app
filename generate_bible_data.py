name: Gerar dados da Bíblia (LSG1910)

on:
  workflow_dispatch:  # botão manual no GitHub

jobs:
  generate:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repositório
        uses: actions/checkout@v4

      - name: Instalar Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Instalar dependências
        run: pip install requests

      - name: Correr script de geração
        run: python generate_bible_data.py

      - name: Commit e push dos dados gerados
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/bible/
          git diff --cached --quiet || git commit -m "chore: regenerar dados LSG1910 limpos"
          git push
