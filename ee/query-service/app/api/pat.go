package api

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"go.signoz.io/signoz/ee/query-service/model"
	"go.signoz.io/signoz/pkg/query-service/auth"
	"go.uber.org/zap"
)

func generatePATToken() string {
	// Generate a 32-byte random token.
	token := make([]byte, 32)
	rand.Read(token)
	// Encode the token in base64.
	encodedToken := base64.StdEncoding.EncodeToString(token)
	return encodedToken
}

func (ah *APIHandler) createPAT(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	req := model.PAT{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, model.BadRequest(err), nil)
		return
	}
	user, err := auth.GetUserFromRequest(r)
	if err != nil {
		RespondError(w, &model.ApiError{
			Typ: model.ErrorUnauthorized,
			Err: err,
		}, nil)
		return
	}

	req.UserID = user.Id
	req.CreatedAt = time.Now().Unix()
	req.Token = generatePATToken()

	zap.S().Infof("Got PAT request: %+v", req)
	if apierr := ah.AppDao().CreatePAT(ctx, &req); apierr != nil {
		RespondError(w, apierr, nil)
		return
	}

	ah.Respond(w, &req)
}

func (ah *APIHandler) getPATs(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	user, _ := auth.GetUserFromRequest(r)
	zap.S().Infof("Get PATs for user: %+v", user.Id)
	pats, apierr := ah.AppDao().ListPATs(ctx, user.Id)
	if apierr != nil {
		RespondError(w, apierr, nil)
		return
	}
	ah.WriteJSON(w, r, pats)
}

func (ah *APIHandler) deletePAT(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	id := mux.Vars(r)["id"]
	zap.S().Infof("Delete PAT with id: %+v", id)
	if apierr := ah.AppDao().DeletePAT(ctx, id); apierr != nil {
		RespondError(w, apierr, nil)
		return
	}
	ah.WriteJSON(w, r, map[string]string{"data": "pat deleted successfully"})
}
