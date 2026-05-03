import { MessageCircle, HelpCircle, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const faqs = [
  {
    question: "Como cadastrar um novo produto?",
    answer:
      "Acesse o menu Produtos e clique em '+ Novo Produto'. Preencha nome, preço, unidade e categoria. O produto ficará disponível no catálogo para seus clientes assim que for salvo e marcado como ativo.",
  },
  {
    question: "Como adicionar um cliente ao sistema?",
    answer:
      "Vá em Clientes → '+ Novo Cliente'. Informe nome, e-mail e telefone. Após salvo, o cliente receberá um convite por e-mail para acessar o catálogo e fazer pedidos.",
  },
  {
    question: "Como aprovar ou recusar um pedido?",
    answer:
      "Abra a aba Aprovações para ver todos os pedidos aguardando revisão. Clique no pedido para ver os detalhes e escolha Aprovar ou Recusar. Pedidos aprovados entram automaticamente na fila de Produção.",
  },
  {
    question: "Como registrar um pagamento como recebido?",
    answer:
      "Acesse Financeiro, localize o pagamento e clique nele. Na tela do pedido você encontrará o botão 'Marcar como Pago'. Também é possível acessar diretamente pela página do pedido.",
  },
  {
    question: "Como emitir uma nota fiscal?",
    answer:
      "Primeiro configure seu token SEFAZ em Configurações → Integrações. Depois, abra um pedido com status Aprovado ou Em Produção e clique em 'Emitir NF-e'. O XML e o DANFE estarão disponíveis na aba Notas Fiscais.",
  },
  {
    question: "Como conectar o Mercado Pago?",
    answer:
      "Vá em Configurações → Integrações → Mercado Pago e clique em 'Conectar Mercado Pago'. Você será redirecionado para autorizar o acesso. Após conectado, links de pagamento serão gerados automaticamente nos pedidos.",
  },
  {
    question: "Como personalizar a loja online?",
    answer:
      "Em Configurações → Loja Online você pode adicionar logo, banner e informações da loja. O link da sua loja para compartilhar com clientes fica disponível nessa mesma tela.",
  },
  {
    question: "Como acompanhar a produção dos pedidos?",
    answer:
      "A aba Produção mostra todos os pedidos em andamento. Você pode atualizar o status de cada pedido (Em Produção → Em Entrega → Entregue) conforme o progresso.",
  },
  {
    question: "Como adicionar novos usuários (operadores/gerentes)?",
    answer:
      "Acesse Configurações → Usuários e clique em '+ Novo Usuário'. Defina o nome, e-mail e nível de acesso (Gerente ou Operador). O usuário receberá um e-mail para criar a senha.",
  },
  {
    question: "O sistema funciona no celular?",
    answer:
      "Sim! O sistema é totalmente responsivo e funciona em qualquer navegador mobile. Para uma experiência ainda melhor, você pode adicionar o site à tela inicial do seu celular como um app.",
  },
];

export default function AjudaPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Central de Ajuda</h1>
        <p className="text-gray-500">Tire suas dúvidas ou fale com nossa equipe.</p>
      </div>

      {/* Suporte card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-800">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-blue-900">Precisa de ajuda personalizada?</p>
              <p className="text-sm text-blue-700">
                Nossa equipe está disponível para te auxiliar via WhatsApp.
              </p>
            </div>
          </div>
          <a
            href="https://wa.me/5511945172652?text=Olá!%20Preciso%20de%20ajuda%20com%20o%20sistema%20Ondda."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg bg-blue-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-900"
          >
            <MessageCircle className="h-4 w-4" />
            Falar com suporte
          </a>
        </CardContent>
      </Card>

      {/* FAQ */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Perguntas Frequentes</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <Card key={i}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 select-none">
                  <span className="text-sm font-medium text-gray-900">{faq.question}</span>
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
                </summary>
                <CardContent className="border-t border-gray-100 px-5 pb-4 pt-3">
                  <p className="text-sm leading-relaxed text-gray-600">{faq.answer}</p>
                </CardContent>
              </details>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
