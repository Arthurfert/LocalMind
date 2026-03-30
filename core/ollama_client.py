"""
Client pour interagir avec Ollama API
"""
import requests


class OllamaClient:
    """Client pour communiquer avec l'API Ollama"""
    
    SYSTEM_PROMPT = """You are a helpful assistant. Follow these formatting rules:
- Use Markdown formatting for your responses (headers, bold, italic, lists, code blocks).
- For mathematical formulas, use LaTeX syntax with $ for inline math and $$ for display math.
- Examples: inline $E = mc^2$, display $$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$
- Always wrap mathematical expressions in $ or $$ delimiters."""
    
    def __init__(self, base_url="http://localhost:11434"):
        self.base_url = base_url
        self.is_aborted = False
        self.current_response = None
        
    def abort(self):
        """Annule la génération en cours"""
        print("Mise à jour du flag is_aborted = True")
        self.is_aborted = True
        if hasattr(self, 'current_response') and self.current_response:
            try:
                # Tente de fermer brutalement le socket TCP sous-jacent pour qu'Ollama s'arrête immédiatement
                try:
                    raw_conn = getattr(self.current_response.raw, '_connection', None)
                    if raw_conn and hasattr(raw_conn, 'sock') and raw_conn.sock:
                        import socket
                        raw_conn.sock.shutdown(socket.SHUT_RDWR)
                except Exception as e:
                    print(f"Impossible de forcer le shutdown du socket: {e}")
                    
                self.current_response.close()
            except Exception as e:
                print(f"Erreur lors de la fermeture de la connexion: {e}")
        
    def get_available_models(self):
        """Récupère la liste des modèles disponibles"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if response.status_code == 200:
                data = response.json()
                return [model['name'] for model in data.get('models', [])]
            return []
        except Exception as e:
            print(f"Erreur lors de la récupération des modèles: {e}")
            return []
    
    def chat_stream(self, model, messages, chunk_callback=None, images=None):
        """
        Utilise l'API chat d'Ollama en mode streaming
        
        Args:
            model: nom du modèle
            messages: liste de messages au format [{role: "user/assistant", content: "..."}]
            chunk_callback: signal appelé pour chaque chunk (optionnel)
            images: liste d'images encodées en base64 (optionnel)
        
        Returns:
            str: réponse complète générée
        """
        try:
            import json
            
            # Si des images sont fournies, les ajouter au dernier message utilisateur
            if images and messages:
                # Trouver le dernier message utilisateur et lui ajouter les images
                for i in range(len(messages) - 1, -1, -1):
                    if messages[i].get('role') == 'user':
                        messages[i]['images'] = images
                        break
            
            # Ajouter le message système au début
            messages_with_system = [{"role": "system", "content": self.SYSTEM_PROMPT}] + messages
            
            self.is_aborted = False
            
            payload = {
                "model": model,
                "messages": messages_with_system,
                "stream": True
            }
            
            response = requests.post(
                f"{self.base_url}/api/chat",
                json=payload,
                stream=True,
                timeout=120
            )
            
            self.current_response = response
            
            if response.status_code == 200:
                full_response = ""
                
                try:
                    for line in response.iter_lines():
                        if self.is_aborted:
                            print("Arrêt de la génération car is_aborted est True")
                            response.close()
                            break
                        
                        if line:
                            try:
                                data = json.loads(line)
                                chunk = data.get('message', {}).get('content', '')
                                if chunk:
                                    full_response += chunk
                                    if chunk_callback:
                                        chunk_callback(chunk)
                            except json.JSONDecodeError:
                                continue
                except Exception as e:
                    # Gérer l'erreur si la socket est fermée manuellement par self.current_response.close()
                    if self.is_aborted:
                        print("Connexion fermée manuellement.")
                    else:
                        print(f"Erreur de lecture du stream: {e}")
                finally:
                    self.current_response = None
                
                return full_response
            else:
                self.current_response = None
                return f"Erreur: {response.status_code}"
                
        except requests.exceptions.Timeout:
            return "Erreur: La requête a expiré. Le modèle met trop de temps à répondre."
        except Exception as e:
            return f"Erreur: {str(e)}"
