from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from main.models import TermsAndConditions

class TermsView(APIView):
    permission_classes = [AllowAny]

    action_handler = {
        'get_terms': 'get_terms',
        'get_privacy_policy': 'get_privacy_policy',
    }

    def get(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handler:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handler[action])
        return handler(request)

    def post(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handler:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handler[action])
        return handler(request)

    def get_terms(self, request):
        try:
            terms = TermsAndConditions.objects.latest('last_updated')

            # Simple HTML structure that matches the mobile design
            styled_html = f"""
            <html>
            <head>
                <meta charset="utf-8"/>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * {{
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }}
                    
                    body {{
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background-color: #FFFFFF;
                        color: #000000;
                        font-size: 16px;
                        line-height: 1.5;
                        padding: 20px;
                    }}
                    
                    .terms-content {{
                        max-width: 800px;
                        margin: 0 auto;
                    }}
                    
                    p {{
                        margin-bottom: 16px;
                        margin-top: 0;
                        color: #000000;
                        line-height: 1.6;
                        font-size: 16px;
                    }}
                    
                    /* Section headers - first strong element in paragraph */
                    p strong:first-child {{
                        display: block;
                        font-size: 18px;
                        font-weight: bold;
                        margin-bottom: 8px;
                        margin-top: 20px;
                        color: #000000;
                    }}
                    
                    /* Regular strong text */
                    strong {{
                        font-weight: 600;
                        color: #000000;
                    }}
                    
                    /* Links */
                    a {{
                        color: #8B5CF6;
                        text-decoration: underline;
                    }}
                </style>
            </head>
            <body>
                <div class="terms-content">
                    {terms.content}
                </div>
            </body>
            </html>
            """
            return Response({
                'version': terms.version,
                'content': styled_html,
                'last_updated': terms.last_updated,
            })
        except TermsAndConditions.DoesNotExist:
            return Response({'error': 'Terms and Conditions not found'}, status=status.HTTP_404_NOT_FOUND)
    


    def get_privacy_policy(self, request):
        try:
            privacy_policy = TermsAndConditions.objects.latest('last_updated')

            # Simple HTML structure that matches the mobile design
            styled_html = f"""
            <html>
            <head>
                <meta charset="utf-8"/>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * {{
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }}
                    
                    body {{
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background-color: #FFFFFF;
                        color: #000000;
                        font-size: 16px;
                        line-height: 1.5;
                        padding: 20px;
                    }}
                    
                    .privacy-content {{
                        max-width: 800px;
                        margin: 0 auto;
                    }}
                    
                    h1 {{
                        font-size: 24px;
                        font-weight: bold;
                        margin-bottom: 20px;
                        color: #000000;
                        text-align: center;
                    }}
                    
                    p {{
                        margin-bottom: 16px;
                        margin-top: 0;
                        color: #000000;
                        line-height: 1.6;
                        font-size: 16px;
                    }}
                    
                    /* Section headers - first strong element in paragraph */
                    p strong:first-child {{
                        display: block;
                        font-size: 18px;
                        font-weight: bold;
                        margin-bottom: 8px;
                        margin-top: 20px;
                        color: #000000;
                    }}
                    
                    /* Regular strong text */
                    strong {{
                        font-weight: 600;
                        color: #000000;
                    }}
                    
                    /* Links */
                    a {{
                        color: #8B5CF6;
                        text-decoration: underline;
                    }}
                    
                    ul, ol {{
                        margin-left: 20px;
                        margin-bottom: 16px;
                    }}
                    
                    li {{
                        margin-bottom: 8px;
                    }}
                </style>
            </head>
            <body>
                <div class="privacy-content">
                    <h1>Privacy Policy</h1>
                    {privacy_policy.content}
                </div>
            </body>
            </html>
            """
            return Response({
                'version': privacy_policy.version,
                'content': styled_html,
                'last_updated': privacy_policy.last_updated,
            })
        except TermsAndConditions.DoesNotExist:
            return Response({'error': 'Privacy Policy not found'}, status=status.HTTP_404_NOT_FOUND)